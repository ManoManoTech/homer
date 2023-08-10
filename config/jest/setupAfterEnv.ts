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
jest.mock('node-fetch');
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

let stopServer = () => Promise.resolve();

beforeAll(async () => {
  const { start } = await import('@/start');
  stopServer = await start();
});

beforeEach(async () => {
  const { clearNodeFetchMock } = (await import('node-fetch')) as any;
  const { clearSequelizeMock } = (await import('sequelize')) as any;
  clearNodeFetchMock();
  clearSequelizeMock();
});

afterAll(async () => {
  await stopServer();
  process.removeAllListeners();
});
