import { attachTask, readTask } from './store';
const [, , operation, taskId, filename] = process.argv;
try {
  if(!taskId||!['read','attach'].includes(operation)||operation==='attach'&&!filename)
    throw new Error('用法：npm run workbench:task -- read <任务号>；或 attach <任务号> <图片绝对路径>');
  const result=operation==='read'?await readTask(taskId):await attachTask(taskId,filename);
  console.log(JSON.stringify(result,null,2));
} catch(error) {
  console.error(error instanceof Error?error.message:'工作台任务无法读取。');
  process.exitCode=1;
}

