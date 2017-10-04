process.env.NODE_ENV = 'production';

require('babel-core/register')({presets:['es2015'],plugins:[
  'transform-object-rest-spread',
  'transform-class-properties',
]});

require('./index');
