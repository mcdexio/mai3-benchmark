FROM ubuntu:20.04 as ubutu

RUN apt update
RUN apt install -y curl python3 python3-pip git

RUN mkdir -p /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 12.13.1

# Install nvm with node and npm
RUN curl --silent -o- https://raw.githubusercontent.com/creationix/nvm/v0.35.3/install.sh | bash
RUN . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default \
    && nvm install --lts

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# install yarn
RUN npm install -g yarn
# install truffle
RUN yarn global add truffle

RUN git clone -b master https://github.com/offchainlabs/arbitrum.git
WORKDIR "arbitrum"
RUN git submodule update --init --recursive
RUN git checkout v0.8.0
RUN git checkout -b v0.8.0
RUN yarn
RUN yarn build
