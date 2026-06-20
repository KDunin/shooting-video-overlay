export class Logger {
  log(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
  error(message: string) {
    console.error(`[${new Date().toISOString()}] ❗ ${message}`);
  }
}
