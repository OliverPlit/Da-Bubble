import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AtMembers } from './at-members';

describe('AtMembers', () => {
  let component: AtMembers;
  let fixture: ComponentFixture<AtMembers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AtMembers]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AtMembers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
