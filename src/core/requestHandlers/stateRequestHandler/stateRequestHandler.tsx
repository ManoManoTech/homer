import { Request, Response } from 'express';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { getProjects, getReviews } from '@/core/services/data';
import { State } from './State';

export async function stateRequestHandler(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const [projects, reviews] = await Promise.all([getProjects(), getReviews()]);
  const data = {
    projects: filter(projects, search),
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
    Object.values(entry).some((value) => value.toString().includes(search))
  );
}
