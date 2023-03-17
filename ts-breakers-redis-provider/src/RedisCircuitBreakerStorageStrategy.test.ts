import { createClient } from 'redis';
import { CircuitBreakerStatus, InMemoryCircuitBreakerStorageStrategy } from 'ts-breakers';
import { RedisCircuitBreakerStorageStrategy } from './RedisCircuitBreakerStorageStrategy';

const defaultConfiguration = {
    failureThreshold: 5,
    recoveryTimeout: 2000,
};
const defaultState = {
    status: CircuitBreakerStatus.CLOSED,
    consecutiveFailures: 0,
};
const remoteConfiguration = {
    recoveryTimeout: 5000,
    failureThreshold: 12,
};
const remoteState = {
    status: CircuitBreakerStatus.OPEN,
    consecutiveFailures: 12,
    lastDetectedFailure: new Date(),
};

const redisHost = '127.0.0.1';
const redisPort = 6379;

const createRedisClient = (host: string, port: number) => {
    return createClient({
        socket: {
            reconnectStrategy: false,
            host: host,
            port: port,
        },
    });
};

describe('Test Suite', () => {
    let id: string;
    let redisClient: ReturnType<typeof createClient>;

    beforeEach(() => (id = Math.random().toString(20).substring(2, 10)));

    afterEach(async () => {
        if (redisClient?.isReady) {
            await redisClient.quit();
        }
    });

    describe('Given Redis is unavailable', () => {
        beforeEach(() => (redisClient = createRedisClient('127.0.0.1', 9999)));

        test('When configuration is loaded, Then it defaults with local values', () => {
            const inMemoryStrategy = new InMemoryCircuitBreakerStorageStrategy(defaultConfiguration, defaultState);
            const redisStrategy = new RedisCircuitBreakerStorageStrategy(id, redisClient, inMemoryStrategy);
            const configuration = redisStrategy.loadConfiguration();
            expect(configuration).toBe(defaultConfiguration);
        });

        test('When state is loaded, Then it defaults with local values', () => {
            const inMemoryStrategy = new InMemoryCircuitBreakerStorageStrategy(defaultConfiguration, defaultState);
            const redisStrategy = new RedisCircuitBreakerStorageStrategy(id, redisClient, inMemoryStrategy);
            const state = redisStrategy.loadState();
            expect(state).toBe(defaultState);
        });
    });

    describe('Given Redis is available', () => {
        beforeEach(() => (redisClient = createRedisClient(redisHost, redisPort)));

        describe('and no remote data is available', () => {
            test('When configuration is loaded, Then remote configuration is updated with local one', (done) => {
                const inMemoryStrategy = new InMemoryCircuitBreakerStorageStrategy(defaultConfiguration, defaultState);
                const redisStrategy = new RedisCircuitBreakerStorageStrategy(id, redisClient, inMemoryStrategy);
                redisStrategy.onConfigurationChange = (previous, next) => {
                    expect(previous).toEqual(defaultConfiguration);
                    expect(next).toEqual(defaultConfiguration);
                    const redis = createRedisClient(redisHost, redisPort);
                    redis
                        .connect()
                        .then(() => redis.get(`${id}.recovery.timeout`))
                        .then((value) => expect(value).toEqual(defaultConfiguration.recoveryTimeout.toString()))
                        .then(() => redis.get(`${id}.failure.threshold`))
                        .then((value) => expect(value).toEqual(defaultConfiguration.failureThreshold.toString()))
                        .then(() => redis.quit())
                        .then(() => done())
                        .catch((error) => done(error));
                };
            });

            test('When state is loaded, Then remote state is updated with local one', (done) => {
                const inMemoryStrategy = new InMemoryCircuitBreakerStorageStrategy(defaultConfiguration, defaultState);
                const redisStrategy = new RedisCircuitBreakerStorageStrategy(id, redisClient, inMemoryStrategy);
                redisStrategy.onStateChange = (previous, next) => {
                    expect(previous).toEqual(defaultState);
                    expect(next).toEqual(defaultState);
                    const redis = createRedisClient(redisHost, redisPort);
                    redis
                        .connect()
                        .then(() => redis.get(`${id}.status`))
                        .then((value) => expect(value).toEqual(defaultState.status.toString()))
                        .then(() => redis.get(`${id}.failure.count`))
                        .then((value) => expect(value).toEqual(defaultState.consecutiveFailures.toString()))
                        .then(() => redis.get(`${id}.failure.last`))
                        .then((value) => expect(value).toBe(''))
                        .then(() => redis.quit())
                        .then(() => done())
                        .catch((error) => done(error));
                };
            });
        });

        describe('and remote data is available,', () => {
            const testRedisClient = createRedisClient(redisHost, redisPort);

            beforeEach(async () => {
                await testRedisClient.connect();
                await testRedisClient.set(`${id}.recovery.timeout`, remoteConfiguration.recoveryTimeout);
                await testRedisClient.set(`${id}.failure.threshold`, remoteConfiguration.failureThreshold);
                await testRedisClient.set(`${id}.status`, remoteState.status);
                await testRedisClient.set(`${id}.failure.count`, remoteState.consecutiveFailures);
                await testRedisClient.set(`${id}.failure.last`, remoteState.lastDetectedFailure.getTime());
                await testRedisClient.quit();
            });

            afterEach(async () => {
                await testRedisClient.connect();
                await testRedisClient.del(`${id}.recovery.timeout`);
                await testRedisClient.del(`${id}.failure.threshold`);
                await testRedisClient.del(`${id}.status`);
                await testRedisClient.del(`${id}.failure.count`);
                await testRedisClient.del(`${id}.failure.last`);
                await testRedisClient.quit();
            });

            test('When configuration is loaded, Then it defaults with local values', async () => {
                const inMemoryStrategy = new InMemoryCircuitBreakerStorageStrategy(defaultConfiguration, defaultState);
                const redisStrategy = new RedisCircuitBreakerStorageStrategy(id, redisClient, inMemoryStrategy);
                const configuration = redisStrategy.loadConfiguration();
                expect(configuration).toEqual(defaultConfiguration);
            });

            test('When state is loaded, Then it defaults with local values', async () => {
                const inMemoryStrategy = new InMemoryCircuitBreakerStorageStrategy(defaultConfiguration, defaultState);
                const redisStrategy = new RedisCircuitBreakerStorageStrategy(id, redisClient, inMemoryStrategy);
                const state = redisStrategy.loadState();
                expect(state).toEqual(defaultState);
            });

            test('When remote configuration is loaded, Then local one is updated', (done) => {
                const inMemoryStrategy = new InMemoryCircuitBreakerStorageStrategy(defaultConfiguration, defaultState);
                const redisStrategy = new RedisCircuitBreakerStorageStrategy(id, redisClient, inMemoryStrategy);
                redisStrategy.onConfigurationChange = (previous, next) => {
                    try {
                        expect(previous).toEqual(defaultConfiguration);
                        expect(next).toEqual(remoteConfiguration);
                        expect(redisStrategy.loadConfiguration()).toEqual(remoteConfiguration);
                        done();
                    } catch (error) {
                        done(error);
                    }
                };
            });

            test('When remote state is loaded, Then local one is updated', (done) => {
                const inMemoryStrategy = new InMemoryCircuitBreakerStorageStrategy(defaultConfiguration, defaultState);
                const redisStrategy = new RedisCircuitBreakerStorageStrategy(id, redisClient, inMemoryStrategy);
                redisStrategy.onStateChange = (previous, next) => {
                    try {
                        expect(previous).toEqual(defaultState);
                        expect(next).toEqual(remoteState);
                        expect(redisStrategy.loadState()).toEqual(remoteState);
                        done();
                    } catch (error) {
                        done(error);
                    }
                };
            });
        });
    });
});
