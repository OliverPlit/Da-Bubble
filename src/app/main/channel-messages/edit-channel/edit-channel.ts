import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { doc, updateDoc } from '@angular/fire/firestore';





@Component({
  selector: 'app-edit-channel',
    standalone: true,
  imports: [CommonModule],
  templateUrl: './edit-channel.html',
  styleUrl: './edit-channel.scss',
})
export class EditChannel {
  dialogRef = inject(MatDialogRef<EditChannel>);
  showInputName = false;
  showInputDescription = false;
  closeName = true;
  closeDescription = true;
  firestore: Firestore = inject(Firestore);
  memberships: any[] = [];
  data = inject(MAT_DIALOG_DATA);
  channel: any;
  editedName = '';
  editedDescription = '';

  constructor( private cdr: ChangeDetectorRef) { }

  async ngOnInit() {
    this.loadData();
  }


  async loadData() {
    if (this.data?.channel) {
      this.channel = { ...this.data.channel };
      this.editedName = this.channel.name || '';
      this.editedDescription = this.channel.description || '';
      this.cdr.detectChanges();
    }
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
    if (!this.editedName.trim()) {
      alert('Channel-Name darf nicht leer sein');
      return;
    }

    try {
      // Channel in Firestore aktualisieren
      const channelRef = doc(this.firestore, 'channels', this.channel.id);
      await updateDoc(channelRef, {
        name: this.editedName.trim()
      });

      // Lokale Daten aktualisieren
      this.channel.name = this.editedName.trim();
      this.showInputName = false;
      this.closeName = true;
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Fehler beim Speichern des Channel-Namens:', error);
      alert('Fehler beim Speichern');
    }
  }

  async saveEditDescription() {
    try {
      // Channel in Firestore aktualisieren
      const channelRef = doc(this.firestore, 'channels', this.channel.id);
      await updateDoc(channelRef, {
        description: this.editedDescription.trim()
      });

      // Lokale Daten aktualisieren
      this.channel.description = this.editedDescription.trim();
      this.showInputDescription = false;
      this.closeDescription = true;
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Fehler beim Speichern der Beschreibung:', error);
      alert('Fehler beim Speichern');
    }
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
