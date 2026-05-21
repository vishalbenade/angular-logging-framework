import {
  Component, EventEmitter, Input, NgZone,
  OnDestroy, Output, inject,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  RowSelectedEvent,
} from 'ag-grid-community';
import type { User } from '../../core/models/user.model';

// Register AG Grid Community modules once at app level
ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-user-grid',
  standalone: true,
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      class="ag-theme-alpine"
      style="width: 100%; height: 500px;"
      [rowData]="rowData"
      [columnDefs]="columnDefs"
      [defaultColDef]="defaultColDef"
      [rowSelection]="'single'"
      [animateRows]="true"
      [quickFilterText]="quickFilterText"
      (gridReady)="onGridReady($event)"
      (rowSelected)="onRowSelected($event)"
    />
  `,
})
export class UserGridComponent implements OnDestroy {
  @Input() rowData: User[]     = [];
  @Input() quickFilterText      = '';
  @Output() rowSelected         = new EventEmitter<User>();
  @Output() gridReadyEvent      = new EventEmitter<GridApi>();

  /** Exposed for test harness access. */
  gridApi!: GridApi;

  private readonly ngZone = inject(NgZone);

  readonly columnDefs: ColDef<User>[] = [
    { field: 'id',     headerName: 'ID',     width: 80,  sortable: true },
    {
      field: 'name',   headerName: 'Name',   flex: 1,    sortable: true,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'email',  headerName: 'Email',  flex: 2,    sortable: true,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'role',   headerName: 'Role',   width: 120, sortable: true,
      filter: 'agTextColumnFilter',
    },
    {
      field: 'status', headerName: 'Status', width: 120, sortable: true,
      filter: 'agTextColumnFilter',
    },
  ];

  readonly defaultColDef: ColDef<User> = {
    resizable:      true,
    suppressMovable: false,
  };

  onGridReady(event: GridReadyEvent<User>): void {
    this.gridApi = event.api;
    this.gridReadyEvent.emit(this.gridApi);
  }

  onRowSelected(event: RowSelectedEvent<User>): void {
    if (event.node.isSelected() && event.data) {
      // PII GUARD: emit data object, but never log cell values
      this.ngZone.run(() => this.rowSelected.emit(event.data!));
    }
  }

  ngOnDestroy(): void {
    // AG Grid cleans up its own event listeners via gridReady API
  }
}
