import compact from '../utils/compact';
import get from '../utils/get';
import unset from '../utils/unset';

export default <T>(ref: T, name: string) =>
  !compact(get(ref, name)).length && unset(ref, name);
