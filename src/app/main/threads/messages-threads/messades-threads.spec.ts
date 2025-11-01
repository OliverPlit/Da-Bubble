import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessadesThreads } from './messades-threads';

describe('MessadesThreads', () => {
  let component: MessadesThreads;
  let fixture: ComponentFixture<MessadesThreads>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessadesThreads]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessadesThreads);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
