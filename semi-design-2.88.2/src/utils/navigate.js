

import { navigate as GastbyNavigate } from 'gatsby';

const navigate = path => {
    if (path.startsWith('/')) {
        GastbyNavigate(path);
    } else {
        try {
            location.href = path;
        } catch (error) {

        }
    }
};

export default navigate;