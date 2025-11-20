import { clearFetchMocks, createFetchMock } from '@root/__mocks__/fetch-mock';

jest.mock('@slack/web-api', () => {
  const chatDelete = jest.fn();
  const info = jest.fn();
  const lookupByEmail = jest.fn();
  const getPermalink = jest.fn();
  const openConversations = jest.fn();
  const openViews = jest.fn();
  const postEphemeral = jest.fn();
  const postMessage = jest.fn();
  const publish = jest.fn();
  const updateChat = jest.fn();
  const updateViews = jest.fn();

  return {
    WebClient: class WebClientMock {
      chat = {
        delete: chatDelete,
        getPermalink,
        postEphemeral,
        postMessage,
        update: updateChat,
      };
      conversations = { open: openConversations };
      users = { info, lookupByEmail };
      views = { open: openViews, publish, update: updateViews };
    },
  };
});
jest.mock('dd-trace', () => ({}));
jest.mock('sequelize');

// ⚠️ The pino logger is not compatible with Jest, please use the console
// instead to debug.
jest.mock('@/core/services/logger', () => ({
  // logger: console,
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock ONLY startup-critical functions from data service
// All other functions use real Sequelize-backed implementations
jest.mock('@/core/services/data', () => {
  const actual = jest.requireActual('@/core/services/data');

  return {
    ...actual,
    // Override ONLY connectToDatabase to avoid actual database connection
    connectToDatabase: jest.fn().mockResolvedValue(undefined),
    // getReleases uses real implementation which works with Sequelize mock
  };
});

let stopServer = () => Promise.resolve();

const originalFetch = (global as any).fetch;

beforeAll(async () => {
  const { start } = await import('@/start');
  stopServer = await start();
});

beforeEach(async () => {
  const { clearSequelizeMock } = (await import('sequelize')) as any;
  clearSequelizeMock();

  clearFetchMocks();
  (global as any).fetch = jest.fn().mockImplementation(createFetchMock(originalFetch));
});

afterAll(async () => {
  await stopServer();
  process.removeAllListeners();
});
