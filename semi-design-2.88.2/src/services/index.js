import get from 'lodash-es/get';
import axios from 'axios';

const STATUS_CODE_SUCCESS = 200;
const STATUS_CODE_NEED_LOGIN = 20001;

export const getChangeLogData = async () => await axios('/changeLog.json')
    .then(resp => get(resp, 'data'));