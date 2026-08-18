FROM ruby:2.7-bullseye

WORKDIR /srv/jekyll

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential git \
  && rm -rf /var/lib/apt/lists/* \
  && gem install bundler -v 2.4.22 \
  && git config --global --add safe.directory /srv/jekyll

ENV BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_FORCE_RUBY_PLATFORM=1 \
    JEKYLL_ENV=development

EXPOSE 4000 35729

CMD ["bash", "-lc", "bundle install && bundle exec jekyll serve --host 0.0.0.0 --port 4000 --watch --force_polling --livereload"]
