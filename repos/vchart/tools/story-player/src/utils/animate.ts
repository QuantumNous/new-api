import type { Action } from '../action/action';
import type { ModelSet } from '../common/model-set';
import type { Page } from '../page';
import type { IAnimationTask } from '../page/interface';

/** 将动画编排成多个队列，形成森林 */
export function getAnimationTasks(actionList: ModelSet<Action>): IAnimationTask[] {
  const resultTasks: IAnimationTask[] = [];
  const allTasks: IAnimationTask[] = [];

  const notIndependentActions: Set<Action> = new Set();

  // 处理独立任务
  actionList.forEach((action) => {
    const id = action.config.lastAction;
    const lastAction = id && actionList.getById(id);
    if (!lastAction) {
      const task: IAnimationTask = {
        timeOffset: action.config.timeOffset ?? 0,
        actionList: [action],
        nextTaskList: [],
      };
      resultTasks.push(task);
      allTasks.push(task);
    } else {
      notIndependentActions.add(action);
    }
  });

  // 处理非独立任务
  while (notIndependentActions.size > 0) {
    [...notIndependentActions].forEach((action) => {
      const id = action.config.lastAction;
      const lastTask = id && allTasks.find((task) => task.actionList[0]?.id === id);
      if (lastTask) {
        const task: IAnimationTask = {
          timeOffset: action.config.timeOffset ?? 0,
          actionList: [action],
          nextTaskList: [],
        };
        lastTask.nextTaskList.push(task); // 把当前任务挂在前置任务上
        allTasks.push(task);
        notIndependentActions.delete(action);
      }
    });
  }

  return resultTasks;
}

/** 执行动画任务 */
export async function runAnimationTask(task: IAnimationTask, page: Page) {
  // offset
  await wait(task.timeOffset ?? 0);
  // 跑当前动画
  await Promise.all(task.actionList.map((action) => action.play(page)));
  // 跑下一个动画
  await Promise.all(task.nextTaskList.map((nextTask) => runAnimationTask(nextTask, page)));
}

export async function wait(duration: number) {
  await new Promise((resolve) => setTimeout(resolve, duration));
}
