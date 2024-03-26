FROM ruby:3.2

WORKDIR /usr/src/app
COPY . .

RUN apt-get update -qq && apt-get install -y build-essential nginx-light

RUN bundle install

EXPOSE 80
ENV LANG C.UTF-8
ENV CONSUL_HTTP_ADDR http://consul-relay.service.consul.preprod.crto.in:8500

ENTRYPOINT ["/usr/local/bin/bundle", "exec", "consul-templaterb"]
CMD ["--template", "samples/consul-ui/consul-keys-ui.html.erb", "--template", "samples/consul-ui/decorators.js.erb", "--template", "samples/consul-ui/consul-nodes-ui.html.erb", "--template", "samples/consul-ui/consul-services-ui.html.erb", "--template", "samples/consul-ui/consul-timeline-ui.html.erb", "--template", "samples/consul-ui/consul_keys.json.erb", "--template", "samples/consul-ui/consul_nodes.json.erb", "--template", "samples/consul-ui/consul_services.json.erb", "--template", "samples/consul-ui/timeline.json.erb", "--template", "samples/consul-ui/consul-services-ui.html.erb:samples/consul-ui/index.html:touch samples/consul-ui/ready", "--sig-reload=NONE", "--exec=nginx -c /usr/src/app/docker-nginx-conf/nginx.conf"]
