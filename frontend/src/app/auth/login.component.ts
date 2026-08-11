import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);

  email = '';
  password = '';
  mode = signal<'signin' | 'signup'>('signin');
  error = signal<string | null>(null);
  busy = signal(false);

  toggle() {
    this.mode.update(m => (m === 'signin' ? 'signup' : 'signin'));
    this.error.set(null);
  }

  async submit() {
    this.busy.set(true);
    this.error.set(null);
    try {
      if (this.mode() === 'signin') {
        await this.auth.signIn(this.email, this.password);
      } else {
        await this.auth.signUp(this.email, this.password);
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      this.busy.set(false);
    }
  }
}
