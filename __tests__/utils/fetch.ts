import nodeFetch, { RequestInit, Response } from 'node-fetch';

export async function fetch(
  url: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    method?: string;
  } = {}
): Promise<Response> {
  const { body = {}, headers = {}, method = 'post' } = options;
  const init = {
    headers: { 'Content-Type': 'application/json', ...headers },
    method,
  } as RequestInit;

  if (method === 'post') {
    init.body = JSON.stringify(body);
  }

  return nodeFetch(`http://localhost:3000${url}`, init);
}
