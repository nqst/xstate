import isDevelopment from '#is-development';
import { cloneState } from '../State.ts';
import { ActorStatus } from '../interpreter.ts';
import {
  ActionArgs,
  ActorRef,
  AnyActorContext,
  AnyState,
  EventObject,
  MachineContext,
  ParameterizedObject
} from '../types.ts';

type ResolvableActorRef<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> =
  | string
  | ActorRef<any>
  | ((
      args: ActionArgs<TContext, TExpressionEvent, TExpressionAction>
    ) => ActorRef<any> | string);

function resolve(
  _: AnyActorContext,
  state: AnyState,
  args: ActionArgs<any, any, any>,
  { actorRef }: { actorRef: ResolvableActorRef<any, any, any> }
) {
  const actorRefOrString =
    typeof actorRef === 'function' ? actorRef(args) : actorRef;
  const resolvedActorRef: ActorRef<any, any> | undefined =
    typeof actorRefOrString === 'string'
      ? state.children[actorRefOrString]
      : actorRefOrString;

  let children = state.children;
  if (resolvedActorRef) {
    children = { ...children };
    delete children[resolvedActorRef.id];
  }
  return [
    cloneState(state, {
      children
    }),
    resolvedActorRef
  ];
}
function execute(
  actorContext: AnyActorContext,
  actorRef: ActorRef<any, any> | undefined
) {
  if (!actorRef) {
    return;
  }
  if (actorRef.status !== ActorStatus.Running) {
    actorContext.stopChild(actorRef);
    return;
  }
  // TODO: recheck why this one has to be deferred
  actorContext.defer(() => {
    actorContext.stopChild(actorRef);
  });
}

export interface StopAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
> {
  (_: ActionArgs<TContext, TExpressionEvent, TExpressionAction>): void;
}

/**
 * Stops an actor.
 *
 * @param actorRef The actor to stop.
 */
export function stop<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TExpressionAction extends ParameterizedObject | undefined
>(
  actorRef: ResolvableActorRef<TContext, TExpressionEvent, TExpressionAction>
): StopAction<TContext, TExpressionEvent, TExpressionAction> {
  function stop(_: ActionArgs<TContext, TExpressionEvent, TExpressionAction>) {
    if (isDevelopment) {
      throw new Error(`This isn't supposed to be called`);
    }
  }

  stop.type = 'xstate.stop';
  stop.actorRef = actorRef;

  stop.resolve = resolve;
  stop.execute = execute;

  return stop;
}
