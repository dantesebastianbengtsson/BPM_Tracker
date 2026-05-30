import { Component, effect, inject } from '@angular/core';
import { FolderRailComponent } from './panes/folder-rail.component';
import { SongPaneComponent } from './panes/song-pane.component';
import { WorkspaceComponent } from './panes/workspace.component';
import { LoginComponent } from './auth/login.component';
import { Store } from './core/store.service';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FolderRailComponent, SongPaneComponent, WorkspaceComponent, LoginComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected auth = inject(AuthService);
  private store = inject(Store);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.store.loadAll();
      }
    }, { allowSignalWrites: true });
  }
}
