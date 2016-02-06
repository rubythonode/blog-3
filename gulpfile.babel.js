'use strict';

// Added for gh-pages deploy
var subtree = require('gulp-subtree');
var cp      = require('child_process');

/**
 * Dependencies
 */
import fs from 'fs';
import path from 'path';
import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import browserSync from 'browser-sync';
import swPrecache from 'sw-precache';
import gulpLoadPlugins from 'gulp-load-plugins';
import pkg from './package.json';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

/**
 * Task 'jekyll' : Build jekyll sites
 */
gulp.task('jekyll', function(done) {
  return cp.spawn('jekyll', ['build'], { stdio: 'inherit' })
    .on('close', done);
});

/**
 * Task 'images' : Optimize images
 */
gulp.task('images', () => gulp.src('_assets/images/**/*.*')
  .pipe($.cache(
    $.imagemin({
      progressive: true,
      interlaced: true
    })
  ))
  .pipe(gulp.dest('images'))
  .pipe($.size({title: 'images'}))
);

/**
 * Task 'styles' : Compile and automatically prefix stylesheets
 */
gulp.task('styles', () => {
  const AUTOPREFIXER_BROWSERS = [
    'ie >= 10',
    'ie_mob >= 10',
    'ff >= 30',
    'chrome >= 34',
    'safari >= 7',
    'opera >= 23',
    'ios >= 7',
    'android >= 4.4',
    'bb >= 10'
  ];

  return gulp.src([
    /* Available Pygments Themes */
    // @see http://jwarby.github.io/jekyll-pygments-themes/languages/javascript.html
    // autumn, borland, bw, colorful, default, emacs, friendly, fruity, github,
    // manni, monokai, murphy, native, pastie, perldoc, tango, trac, vim, vs, zenburn
    //'_assets/vendor/jekyll-pygments-themes/github.css',
    '_assets/styles/main.scss'
  ])
  .pipe($.newer('.tmp/styles'))
  .pipe($.sourcemaps.init())
  .pipe($.sass({precision: 10}).on('error', $.sass.logError))
  .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
  .pipe(gulp.dest('.tmp/styles'))
  .pipe($.concat('main.min.css'))
  .pipe($.if('*.css', $.minifyCss()))
  .pipe($.size({title: 'styles'}))
  .pipe($.sourcemaps.write('./'))
  .pipe(gulp.dest('styles'));
});

/**
 * Task 'scripts' : Concatenate and minify JavaScript.
 */
gulp.task('scripts', () =>
  gulp.src([
    '_assets/vendor/fastclick/lib/fastclick.js',
    '_assets/vendor/jquery/dist/jquery.js',
    '_assets/vendor/simple-jekyll-search/dest/jekyll-search.js',
    '_assets/vendor/bootstrap-sass/assets/javascripts/bootstrap.js',
    '_assets/vendor/bootstrap-material-design/scripts/material.js',
    '_assets/vendor/bootstrap-material-design/scripts/ripples.js',
    '_assets/scripts/main.js'
  ])
  .pipe($.sourcemaps.init())
  .pipe($.babel())
  .pipe($.sourcemaps.write())
  .pipe(gulp.dest('.tmp/scripts'))
  .pipe($.concat('main.min.js'))
  .pipe($.uglify({preserveComments: 'some'}))
  .pipe($.size({title: 'scripts'}))
  .pipe($.sourcemaps.write('.'))
  .pipe(gulp.dest('scripts'))
);

/**
 * Task 'clean' : Clean output directory
 */
gulp.task('clean', cb => del(['.tmp', 'scripts', 'styles', 'public'], {dot: true}));

/**
 * Task 'serve' : Watch files for changes & reload
 */
gulp.task('serve', ['images', 'styles', 'scripts', 'jekyll'], () => {
  browserSync({
    notify: false,
    logPrefix: 'Jekyll',
    server: ['.tmp', 'public'],
    port: 3000
  });

  gulp.watch(['_assets/styles/**/*.{scss,css}'], ['styles', 'jekyll', reload]);
  gulp.watch(['_assets/scripts/**/*.js'], ['scripts', 'jekyll', reload]);
  gulp.watch(['_assets/images/**/*'], ['images', 'jekyll', reload]);
  gulp.watch(['**/*.{html,md,markdown}', '!public/**/*.*'], ['jekyll', reload]);
});

/**
 * Task 'default' : Build production files, the default task
 */
gulp.task('default', [], cb => runSequence(
  'styles',
  'scripts',
  'images',
  'jekyll',
  cb
  )
);

/**
 * Task 'deploy' : This will run the build task, then push it to the gh-pages branch
 */
gulp.task('deploy', [], () => {
  // Uncomment paths to published from .gitignore
  cp.spawn('sed', ['-i', '""', 's/images/#images/', '.gitignore'], { stdio: 'inherit' });
  cp.spawn('sed', ['-i', '""', 's/public/#public/', '.gitignore'], { stdio: 'inherit' });
  cp.spawn('sed', ['-i', '""', 's/styles/#styles/', '.gitignore'], { stdio: 'inherit' });
  cp.spawn('sed', ['-i', '""', 's/scripts/#scripts/', '.gitignore'], { stdio: 'inherit' });

  gulp.src('public').pipe($.subtree());

  // Re-comment paths to be ignored
  //return cp.spawn('git', ['checkout', '.gitignore'], { stdio: 'inherit' });
});
