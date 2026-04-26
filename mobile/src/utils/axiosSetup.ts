import axios from 'axios';
import axiosRetry from 'axios-retry';

// Apply retry logic to the global axios instance for offline tolerance
axiosRetry(axios, { 
  retries: 3, 
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNABORTED';
  }
});

export default axios;
