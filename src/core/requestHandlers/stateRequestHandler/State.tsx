import React from 'react';
import { DataProject, DataReview } from '@/core/typings/Data';
import { Highlight, themeStyles } from './Highlight';

interface Props {
  data: {
    projects: DataProject[];
    reviews: DataReview[];
  };
  search: string;
}

export function State({ data, search }: Props) {
  const { projects, reviews } = data;

  return (
    <html>
      <head>
        <title>Homer state</title>
        <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
        <style
          dangerouslySetInnerHTML={{
            __html: `\
body {
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  font-size: 14px;
  margin: 15px 20px;
}

input {
  padding: 10px;
  width: 100%;
  box-shadow: -1px 0 0 0 #358ccb, 0 0 0 1px #dfdfdf;
  border: none;
  border-left: 10px solid #358ccb;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  font-size: 1em;
}
`,
          }}
        />
      </head>
      <body>
        <h1>Homer State</h1>
        <section>
          <form>
            <input
              aria-label="filter state content"
              autoFocus
              defaultValue={search}
              id="search"
              name="search"
              placeholder="Filter"
              type="search"
            />
          </form>
        </section>
        <section>
          <h2>Projects</h2>
          <Highlight data={projects} />
        </section>
        <section>
          <h2>Reviews</h2>
          <Highlight data={reviews} />
        </section>
        <script
          dangerouslySetInnerHTML={{
            __html: `\
document.getElementById('search').addEventListener('focus', ({ currentTarget }) => {
  const { value } = currentTarget;
  event.currentTarget.value = '';
  event.currentTarget.value = value;
});
`,
          }}
        />
      </body>
    </html>
  );
}
