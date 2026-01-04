const log = (text: any, ...rest: any[]) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(text, ...rest);
    }
};
export default log;