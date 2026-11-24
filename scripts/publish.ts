/**
 * Fecha o ciclo: commita a base atualizada e, opcionalmente, dispara o
 * deploy e o IndexNow. Uso:
 *
 *   npm run publish             — só commita e empurra as mudanças de dados
 *   npm run publish -- --deploy — commit, push, deploy no Pages e IndexNow
 */
import { execSync } from 'node:child_process';

const rodar = (cmd: string) => execSync(cmd, { stdio: 'inherit' });

function temMudanca(): boolean {
  try {
    execSync('git diff --quiet -- src/data', { stdio: 'pipe' });
    execSync('git diff --cached --quiet -- src/data', { stdio: 'pipe' });
    return false;
  } catch {
    return true;
  }
}

function main() {
  if (temMudanca()) {
    rodar('git add src/data/codes.json src/data/pending.json');
    rodar('git commit -m "data: atualização da base de códigos"');
  } else {
    console.log('sem mudanças na base');
  }
  rodar('git push');
  if (process.argv.includes('--deploy')) {
    rodar('npm run deploy');
    rodar('npm run indexnow');
  }
}

main();
