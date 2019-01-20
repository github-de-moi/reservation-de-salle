import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { ConfirmDeleteDialog } from './confirm-delete.dialog';
import { EditEventDialog } from './edit-event.dialog';

@NgModule({
  declarations: [
    AppComponent,
    ConfirmDeleteDialog,
    EditEventDialog
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [ AppComponent ]
})
export class AppModule { }
