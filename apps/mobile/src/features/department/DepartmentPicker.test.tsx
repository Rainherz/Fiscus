import { fireEvent, render, screen } from '@testing-library/react-native';

import { DepartmentPicker } from './DepartmentPicker';

describe('DepartmentPicker', () => {
  it('lists the 25 departments and marks the selected one', async () => {
    await render(<DepartmentPicker visible selectedCode={4} onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(25);
    expect(screen.getByRole('radio', { name: 'Arequipa' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Cusco' })).not.toBeChecked();
  });

  it('selects a department', async () => {
    const onSelect = jest.fn();
    await render(<DepartmentPicker visible selectedCode={4} onSelect={onSelect} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Cusco' }));
    expect(onSelect).toHaveBeenCalledWith(8);
  });

  it('closes', async () => {
    const onClose = jest.fn();
    await render(<DepartmentPicker visible selectedCode={4} onSelect={() => {}} onClose={onClose} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
