const gulp = require('gulp');
const replace = require('gulp-replace');
const rename = require('gulp-rename');
require('dotenv').config();

// Production build task - replaces config.js in place (used by Netlify)
gulp.task('build', () => {
  return gulp.src('config.js')
    .pipe(replace('{{GOOGLE_API_KEY}}', process.env.GOOGLE_API_KEY || ''))
    .pipe(replace('{{OPENROUTER_API_KEY}}', process.env.OPENROUTER_API_KEY || ''))
    .pipe(replace('{{OWNER_PHONE_NUMBER}}', process.env.OWNER_PHONE_NUMBER || '+16509954591'))
    .pipe(gulp.dest('.'));
});

// Development build task - creates config.dev.js for local development
gulp.task('build:dev', gulp.parallel(
  () => {
    return gulp.src('config.js')
      .pipe(replace('{{GOOGLE_API_KEY}}', process.env.GOOGLE_API_KEY || ''))
      .pipe(replace('{{OPENROUTER_API_KEY}}', process.env.OPENROUTER_API_KEY || ''))
      .pipe(replace('{{OWNER_PHONE_NUMBER}}', process.env.OWNER_PHONE_NUMBER || '+16509954591'))
      .pipe(rename('config.dev.js'))
      .pipe(gulp.dest('.'));
  },
  () => {
    return gulp.src('index.html')
      .pipe(replace('config.built.js', 'config.dev.js'))
      .pipe(rename('index.dev.html'))
      .pipe(gulp.dest('.'));
  }
));

// Development server with build
gulp.task('serve', gulp.series('build:dev', () => {
  const httpServer = require('http-server');
  const server = httpServer.createServer({
    root: '.',
    cache: -1
  });
  server.listen(3000, () => {
    console.log('Server running on http://localhost:3000/index.dev.html');
  });
}));
