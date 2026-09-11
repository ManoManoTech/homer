import { getViewStateValue } from '@/core/utils/getViewStateValue';

describe('core > utils > getViewStateValue', () => {
  const view = {
    state: {
      values: {
        'a-rotated-block-id-1148': {
          'select-project-action': { selected_option: { value: '1148' } },
        },
        'another-rotated-block-id-1148-1.2.3': {
          'tag-action': { type: 'plain_text_input', value: '1.2.4' },
        },
      },
    },
  };

  it('should find a value whatever the block it belongs to', () => {
    expect(
      getViewStateValue(view, 'select-project-action')?.selected_option?.value,
    ).toEqual('1148');
    expect(getViewStateValue(view, 'tag-action')?.value).toEqual('1.2.4');
  });

  it('should return undefined for an unknown action id', () => {
    expect(getViewStateValue(view, 'unknown-action')).toBeUndefined();
  });

  it('should return undefined whether the state is missing', () => {
    expect(getViewStateValue(undefined, 'tag-action')).toBeUndefined();
    expect(getViewStateValue({}, 'tag-action')).toBeUndefined();
    expect(getViewStateValue({ state: {} }, 'tag-action')).toBeUndefined();
    expect(
      getViewStateValue({ state: { values: {} } }, 'tag-action'),
    ).toBeUndefined();
  });
});
