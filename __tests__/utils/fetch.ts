import type { RequestInit, Response } from 'node-fetch';
import nodeFetch from 'node-fetch';

export async function fetch(
  url: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    method?: string;
  } = {}
): Promise<Response> {
  const { body = {}, headers = {}, method = 'post' } = options;
  const init: RequestInit = {
    headers: { 'Content-Type': 'application/json', ...headers },
    method,
  };

  if (method === 'post') {
    init.body = JSON.stringify(body);
  }

  return nodeFetch(`http://localhost:3000${url}`, init);
}
