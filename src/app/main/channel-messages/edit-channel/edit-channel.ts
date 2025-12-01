import { Component, inject, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { ChangeDetectorRef } from '@angular/core';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';




@Component({
  selector: 'app-edit-channel',
    standalone: true,
imports: [CommonModule, MatButtonModule, MatInputModule],
  templateUrl: './edit-channel.html',
  styleUrl: './edit-channel.scss',
})
export class EditChannel {
    dialogRef = inject(MatDialogRef<EditChannel>);
  data = inject(MAT_DIALOG_DATA);
  firestore = inject(Firestore);

  channel: any;
  editedName = '';
  editedDescription = '';
  showInputName = false;
  showInputDescription = false;
  closeName = true;
  closeDescription = true;

  constructor( private cdr: ChangeDetectorRef) { }

 
ngOnInit() {
    console.log('=== DEBUG EditChannel ngOnInit ===');
    console.log('MAT_DIALOG_DATA empfangen:', this.data);
    console.log('data.channel:', this.data?.channel);

    // ✅ Prüfe ob data und data.channel existieren
    if (!this.data) {
      console.error('❌ Keine Daten empfangen!');
      return;
    }

    if (!this.data.channel) {
      console.error('❌ Kein Channel in data! Data:', this.data);
      return;
    }

    this.channel = this.data.channel;

    // ✅ Prüfe ob Channel-ID vorhanden ist
    if (!this.channel.id) {
      console.error('❌ Channel hat keine ID!', this.channel);
    }

    this.editedName = this.channel.name || '';
    this.editedDescription = this.channel.description || '';

    console.log('✅ Channel erfolgreich geladen:', {
      id: this.channel.id,
      name: this.channel.name,
      description: this.channel.description,
      members: this.channel.members
    });
  }




  close() {
    this.dialogRef.close();
  }


  toggleEditName() {
    this.showInputName = true;
    this.closeName = false;
        this.editedName = this.channel.name || '';

  }

  toggleEditDescription() {
    this.showInputDescription = true;
    this.closeDescription = false;
        this.editedDescription = this.channel.description || '';


  }

  async saveEditName() {
    if (!this.editedName.trim()) return;
    const channelRef = doc(this.firestore, 'channels', this.channel.id);
    await updateDoc(channelRef, { name: this.editedName.trim() });
    this.channel.name = this.editedName.trim();
    this.showInputName = false;
    this.closeName = true;
    this.cdr.detectChanges();
  }

  async saveEditDescription() {
    const channelRef = doc(this.firestore, 'channels', this.channel.id);
    await updateDoc(channelRef, { description: this.editedDescription.trim() });
    this.channel.description = this.editedDescription.trim();
    this.showInputDescription = false;
    this.closeDescription = true;
    this.cdr.detectChanges();
  }

  async leaveChannel() {
    const confirmed = confirm(`Möchten Sie den Channel "${this.channel.name}" wirklich verlassen?`);
    if (!confirmed) return;

    try {
      const storedUser = localStorage.getItem('currentUser');
      if (!storedUser) return;

      const uid = JSON.parse(storedUser).uid;
      
      // Membership aus der users/memberships Collection entfernen
      const membershipRef = doc(
        this.firestore, 
        'users', 
        uid, 
        'memberships', 
        this.channel.id
      );
      
      // Hier würde deleteDoc verwendet werden
      // import { deleteDoc } from '@angular/fire/firestore';
      // await deleteDoc(membershipRef);

      this.dialogRef.close({ action: 'left' });
    } catch (error) {
      console.error('Fehler beim Verlassen des Channels:', error);
      alert('Fehler beim Verlassen des Channels');
    }
  }


}
