import { Router } from 'express';
import { commandRequestHandler } from '@/core/requestHandlers/commandRequestHandler';
import { eventRequestHandler } from '@/core/requestHandlers/eventRequestHandler';
import { gitlabHookHandler } from '@/core/requestHandlers/gitlabHookHandler';
import { helpRequestHandler } from '@/core/requestHandlers/helpRequestHandler';
import { interactiveRequestHandler } from '@/core/requestHandlers/interactiveRequestHandler';
import { catchAsyncRouteErrors } from '@/core/utils/catchAsyncRouteErrors';

const router = Router();

router.post('/command', catchAsyncRouteErrors(commandRequestHandler));
router.post('/event', catchAsyncRouteErrors(eventRequestHandler));
router.post('/gitlab', catchAsyncRouteErrors(gitlabHookHandler));
router.post('/interactive', catchAsyncRouteErrors(interactiveRequestHandler));
router.post('/release', helpRequestHandler);
router.post('/review', helpRequestHandler);

export { router };
