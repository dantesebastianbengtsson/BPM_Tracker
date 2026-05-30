import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SUPABASE } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sb = inject(SUPABASE);

  readonly session = signal<Session | null>(null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  constructor() {
    this.sb.auth.getSession().then(({ data }) => this.session.set(data.session));
    this.sb.auth.onAuthStateChange((_event, session) => this.session.set(session));
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.sb.auth.signOut();
    if (error) throw error;
  }
}
