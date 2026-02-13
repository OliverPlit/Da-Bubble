import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreadsMessages } from './threads-messages';

describe('ThreadsMessages', () => {
  let component: ThreadsMessages;
  let fixture: ComponentFixture<ThreadsMessages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreadsMessages]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThreadsMessages);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
