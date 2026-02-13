import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreadsHeader } from './threads-header';

describe('ThreadsHeader', () => {
  let component: ThreadsHeader;
  let fixture: ComponentFixture<ThreadsHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreadsHeader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThreadsHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
