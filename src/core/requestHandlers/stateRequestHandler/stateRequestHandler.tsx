import type { Request, Response } from 'express';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { getProjects, getReleases, getReviews } from '@/core/services/data';
import { State } from './State';

export async function stateRequestHandler(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const [projects, releases, reviews] = await Promise.all([
    getProjects(),
    getReleases(),
    getReviews(),
  ]);
  const data = {
    projects: filter(projects, search),
    releases: filter(releases, search),
    reviews: filter(reviews, search),
  };

  res.send(
    ReactDOMServer.renderToStaticMarkup(<State data={data} search={search} />)
  );
}

function filter<T extends Record<any, any>>(data: T[], search: string): T[] {
  if (search.length === 0) {
    return data;
  }
  return data.filter((entry) =>
    Object.values(entry).some((value) => `${value}`.includes(search))
  );
}
