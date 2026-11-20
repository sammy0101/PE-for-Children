import './styles.css';
import { createWorksheetRepo } from './storage/worksheetRepo';
import { mountApp } from './ui/app';

const root = document.getElementById('app');
if (!root) {
  throw new Error('找不到 #app 掛載節點');
}

const repo = createWorksheetRepo();
void mountApp(root, repo);
