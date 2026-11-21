import { TestBed } from '@angular/core/testing';
import { ComingSoon } from './coming-soon';

describe('ComingSoon', () => {
  it('shows the screen name and its milestone', async () => {
    const fixture = TestBed.createComponent(ComingSoon);
    fixture.componentRef.setInput('title', 'Tickets');
    fixture.componentRef.setInput('milestone', 'M2');
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Tickets');
    expect(text).toContain('Arriving in M2');
  });
});
