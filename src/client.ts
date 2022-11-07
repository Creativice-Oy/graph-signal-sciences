import axios from 'axios';
import axiosRetry from 'axios-retry';
import {
  IntegrationProviderAuthenticationError,
  IntegrationProviderAPIError,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from './config';
import {
  SignalSciencesUser,
  SignalSciencesCorp,
  SignalSciencesCloudWAF,
  SigSciResponseFormat,
} from './types';

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;

const BASE_URI = 'https://dashboard.signalsciences.net/api/v0';

/**
 * API Client providing access to key Signal Science resources.
 * NOTE: pagination is not supported by provider on /corps and /users.
 * Pagination, in general, is supported by other endpoints. This will
 * need to be considered during future development.
 * TODO: Add pagination.
 */
export class SignalSciencesAPIClient {
  private tokenRequest: {
    email: string;
    password: string;
  };

  constructor(
    readonly logger: IntegrationLogger,
    readonly config: IntegrationConfig,
  ) {
    axiosRetry(axios, {
      retries: 5,
      retryDelay: (retryCount, error) => {
        if (error.response?.status === 429) {
          return retryCount * 1000;
        }

        return 0;
      },
    });
    this.tokenRequest = {
      email: config.email,
      password: config.password,
    };
  }

  private token: string;

  public async verifyAuthentication(): Promise<void> {
    const endpoint = `${BASE_URI}/corps`;

    await this.fetch(endpoint);
  }

  /**
   * Iterates each corp resource in the provider.
   * Note: Pagination is not currently supported on this endpoint by the provider.
   *
   * @param iteratee receives each resource to produce entities/relationship
   */
  public async iterateCorps(
    iteratee: ResourceIteratee<SignalSciencesCorp>,
  ): Promise<void> {
    const endpoint = `${BASE_URI}/corps`;

    const { data } = await this.fetch(endpoint);

    for (const corp of data) {
      await iteratee(corp);
    }
  }

  /**
   * Iterates each user resource in the provider based on the provided corp.
   * Note: Pagination is not currently supported on this endpoint by the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateUsers(
    corpName: string,
    iteratee: ResourceIteratee<SignalSciencesUser>,
  ): Promise<void> {
    const endpoint = this.buildEndpoint(corpName, '/users');

    const { data } = await this.fetch(endpoint);

    for (const user of data) {
      await iteratee(user);
    }
  }

  public async iterateCloudWAFInstances(
    corpName: string,
    iteratee: ResourceIteratee<SignalSciencesCloudWAF>,
  ): Promise<void> {
    const endpoint = this.buildEndpoint(corpName, '/cloudwafInstances');

    const { data } = await this.fetch(endpoint);

    for (const cloudwaf of data) {
      await iteratee(cloudwaf);
    }
  }

  private buildEndpoint(corp: string, path?: string) {
    if (!corp) {
      throw new Error(`Parameter 'corp' is required, but received ${corp}`);
    }

    if (path) {
      return `${BASE_URI}/corps/${corp}${path}`;
    } else {
      return `${BASE_URI}/corps/${corp}`;
    }
  }

  public async authenticate(): Promise<any> {
    try {
      const url = require('url');
      const params = new url.URLSearchParams(this.tokenRequest);
      const response = await axios.post(`${BASE_URI}/auth`, params.toString());

      return response.data.token;
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        endpoint: `${BASE_URI}/auth`,
        status: err.status,
        statusText: err.statusText,
      });
    }
  }

  /**
   * Makes GET request, returning data or throws an error.
   * @param endpoint
   * @param options
   * @returns Promise
   */
  private async fetch(endpoint: string): Promise<SigSciResponseFormat> {
    this.token = await this.authenticate();
    const { status, statusText, data } = await axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      // Prevents non-200 responses from failing the promise.
      validateStatus: () => true,
    });

    if (status === 200) {
      return data as SigSciResponseFormat;
    } else if ([401, 403].includes(status)) {
      throw new IntegrationProviderAuthenticationError({
        endpoint,
        cause: new Error(data),
        status: status,
        statusText: statusText,
      });
    } else {
      throw new IntegrationProviderAPIError({
        endpoint,
        cause: new Error(data),
        status: status,
        statusText: statusText,
      });
    }
  }
}

export function createAPIClient(
  logger: IntegrationLogger,
  config: IntegrationConfig,
): SignalSciencesAPIClient {
  return new SignalSciencesAPIClient(logger, config);
}
