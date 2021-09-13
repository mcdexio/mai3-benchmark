FROM ubuntu:20.04 as ubutu

ENV DEBIAN_FRONTEND noninteractive

RUN apt update
RUN apt install -y curl python3 python3-pip git
RUN apt-get update && \
    apt-get install -y software-properties-common && \
    rm -rf /var/lib/apt/lists/*
RUN add-apt-repository -y ppa:longsleep/golang-backports
RUN apt install -y autoconf automake cmake libboost-dev libboost-filesystem-dev libgmp-dev libssl-dev libgflags-dev libsnappy-dev zlib1g-dev libbz2-dev liblz4-dev libzstd-dev libtool golang-go clang-format

# Install nvm with node and npm
RUN mkdir -p /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 12.13.1

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

WORKDIR /

RUN git clone https://github.com/mcdexio/mai3-benchmark.git
WORKDIR "mai3-benchmark"
RUN git checkout dev
# RUN git submodule update --init --recursive
# RUN yarn
# RUN yarn build
