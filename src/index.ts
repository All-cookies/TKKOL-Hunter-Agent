#!/usr/bin/env node

import 'dotenv/config';
import inquirer from 'inquirer';
import { KOLRepl } from './cli/repl';
import { SessionStore } from './session/SessionStore';

async function main() {
  const currentSession = SessionStore.loadCurrent();

  if (currentSession && !currentSession.isComplete) {
    console.log('📂 发现未完成的会话。');
    console.log(`   阶段: ${currentSession.currentPhase}`);
    console.log(`   更新: ${new Date(currentSession.updatedAt).toLocaleString()}`);

    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: '你想怎么做？',
        choices: [
          { name: '继续未完成的会话', value: 'resume' },
          { name: '开始新的会话', value: 'new' },
          { name: '退出', value: 'exit' },
        ],
      },
    ]);

    if (choice === 'exit') {
      console.log('下次见！');
      process.exit(0);
    }

    if (choice === 'resume') {
      const repl = new KOLRepl(currentSession);
      await repl.run();
      return;
    }
  }

  const repl = new KOLRepl();
  await repl.run();
}

main().catch(console.error);