export const reducer = (state, action) => {
  switch (action.type) {
    case 'set':
      return {
        ...state,
        status: action.payload,
      };
    case 'unset':
      return {
        ...state,
        status: undefined,
      };
    default:
      return state;
  }
};

export const initialState = {
  status: undefined,
};
