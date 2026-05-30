import { Component, OnInit, inject } from '@angular/core';
import { FolderRailComponent } from './panes/folder-rail.component';
import { SongPaneComponent } from './panes/song-pane.component';
import { WorkspaceComponent } from './panes/workspace.component';
import { Store } from './core/store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FolderRailComponent, SongPaneComponent, WorkspaceComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private store = inject(Store);

  async ngOnInit() {
    await this.store.loadAll();
  }
}
