import { Router } from 'express';
import { requireRequestSource } from '@/core/middlewares/securityMiddleware';
import { commandRequestHandler } from '@/core/requestHandlers/commandRequestHandler';
import { eventRequestHandler } from '@/core/requestHandlers/eventRequestHandler';
import { githubHookHandler } from '@/core/requestHandlers/githubHookHandler';
import { gitlabHookHandler } from '@/core/requestHandlers/gitlabHookHandler';
import { helpRequestHandler } from '@/core/requestHandlers/helpRequestHandler';
import { interactiveRequestHandler } from '@/core/requestHandlers/interactiveRequestHandler';
import { catchAsyncRouteErrors } from '@/core/utils/catchAsyncRouteErrors';

const router = Router();

const fromGithub = requireRequestSource('github');
const fromGitlab = requireRequestSource('gitlab');
const fromSlack = requireRequestSource('slack');

router.post(
  '/command',
  fromSlack,
  catchAsyncRouteErrors(commandRequestHandler),
);
router.post('/event', fromSlack, catchAsyncRouteErrors(eventRequestHandler));
router.post('/github', fromGithub, catchAsyncRouteErrors(githubHookHandler));
router.post('/gitlab', fromGitlab, catchAsyncRouteErrors(gitlabHookHandler));
router.post(
  '/interactive',
  fromSlack,
  catchAsyncRouteErrors(interactiveRequestHandler),
);
router.post('/release', helpRequestHandler);
router.post('/review', helpRequestHandler);

export { router };
