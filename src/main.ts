import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

async function bootstrap(): Promise<void> {
  if (environment.useMocks) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
  await bootstrapApplication(AppComponent, appConfig);
}

bootstrap().catch(console.error);
