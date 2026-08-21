// this is a comment
if (process.env.NODE_ENV === 'production') {
  console.log('this is production mode!');
} else if (process.env.NODE_ENV === 'development') {
  console.log('this is development mode!');
} else {
  console.log('this is none mode!');
}
