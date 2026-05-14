import fs from 'fs';
import path from 'path';
import os from 'os';
import { Session } from './SessionState';
import { AGENT_DIR, CURRENT_SESSION_FILE } from '../constants';

function getAgentDir(): string {
  return path.join(os.homedir(), AGENT_DIR);
}

function ensureAgentDir() {
  const dir = getAgentDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export class SessionStore {
  static save(state: Session): string {
    const dir = ensureAgentDir();
    const filepath = path.join(dir, `${state.id}.json`);
    fs.writeFileSync(filepath, JSON.stringify(state.toJSON(), null, 2));

    const currentPath = path.join(dir, CURRENT_SESSION_FILE);
    fs.writeFileSync(currentPath, JSON.stringify({ id: state.id }, null, 2));

    return filepath;
  }

  static load(id: string): Session | null {
    const dir = getAgentDir();
    const filepath = path.join(dir, `${id}.json`);
    if (!fs.existsSync(filepath)) return null;

    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    return Session.fromJSON(data);
  }

  static loadCurrent(): Session | null {
    const dir = getAgentDir();
    const currentPath = path.join(dir, CURRENT_SESSION_FILE);
    if (!fs.existsSync(currentPath)) return null;

    const { id } = JSON.parse(fs.readFileSync(currentPath, 'utf-8'));
    return this.load(id);
  }

  static listSessions(): Array<{ id: string; updatedAt: string; phase: string }> {
    const dir = getAgentDir();
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && f !== CURRENT_SESSION_FILE)
      .map(f => {
        const filepath = path.join(dir, f);
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        return {
          id: data.id,
          updatedAt: data.updatedAt,
          phase: data.currentPhase,
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  static delete(id: string): boolean {
    const dir = getAgentDir();
    const filepath = path.join(dir, `${id}.json`);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }
}