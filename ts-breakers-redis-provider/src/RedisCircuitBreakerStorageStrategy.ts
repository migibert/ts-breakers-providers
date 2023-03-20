import type { createClient } from 'redis';
import { CircuitBreakerState, CircuitBreakerStorageStrategy, CircuitBreakerConfiguration } from 'ts-breakers';
import { MappingError, mapToNumber, mapToOptionalDate, mapToStatus } from './CircuitBreakerMapper';
import { areConfigurationsEqual, areStatesEqual } from './utils';

type RedisClientType = ReturnType<typeof createClient>;

enum RedisKeys {
    STATUS = 'status',
    RECOVERY_TIMEOUT = 'recovery.timeout',
    FAILURE_THRESHOLD = 'failure.threshold',
    FAILURE_COUNT = 'failure.count',
    LAST_FAILURE = 'failure.last',
}

const buildKey = (id: string, key: string): string => `${id}.${key}`;

class RedisCircuitBreakerStorageStrategy implements CircuitBreakerStorageStrategy {
    private delegate: CircuitBreakerStorageStrategy;
    private client: RedisClientType;

    private _onConfigurationChange?: (previous: CircuitBreakerConfiguration, next: CircuitBreakerConfiguration) => void;
    private _onStateChange?: (previous: CircuitBreakerState, next: CircuitBreakerState) => void;

    private statusKey: string;
    private recoveryTimeoutKey: string;
    private failureThresholdKey: string;
    private failureCountKey: string;
    private lastDetectedFailureKey: string;

    public constructor(
        id: string,
        client: RedisClientType,
        delegate: CircuitBreakerStorageStrategy,
        refreshDelay?: number,
    ) {
        this.delegate = delegate;
        this.client = client;

        this.statusKey = buildKey(id, RedisKeys.STATUS);
        this.recoveryTimeoutKey = buildKey(id, RedisKeys.RECOVERY_TIMEOUT);
        this.failureThresholdKey = buildKey(id, RedisKeys.FAILURE_THRESHOLD);
        this.failureCountKey = buildKey(id, RedisKeys.FAILURE_COUNT);
        this.lastDetectedFailureKey = buildKey(id, RedisKeys.LAST_FAILURE);

        this.client.on('error', (error) => console.error('An error occurred with Redis', error));

        if (refreshDelay) {
            setInterval(() => this.refresh(), refreshDelay);
        }
        this.client
            .connect()
            .then(() => this.refresh())
            .catch((error) => console.error('Unable to connect to Redis', error));
    }

    private refresh() {
        this.loadConfiguration();
        this.loadState();
    }

    public set onConfigurationChange(
        observer: (previous: CircuitBreakerConfiguration, next: CircuitBreakerConfiguration) => void,
    ) {
        this._onConfigurationChange = observer;
    }

    public set onStateChange(observer: (previous: CircuitBreakerState, next: CircuitBreakerState) => void) {
        this._onStateChange = observer;
    }

    private notifyStateChange(previous: CircuitBreakerState, next: CircuitBreakerState): void {
        if (this._onStateChange) {
            this._onStateChange(previous, next);
        }
    }

    private notifyConfigurationChange(previous: CircuitBreakerConfiguration, next: CircuitBreakerConfiguration): void {
        if (this._onConfigurationChange) {
            this._onConfigurationChange(previous, next);
        }
    }

    public saveState(state: CircuitBreakerState): void {
        this.delegate.saveState(state);
        this.saveRemoteState(state);
    }

    public loadState(): CircuitBreakerState {
        const localState = this.delegate.loadState();
        this.loadRemoteState()
            .then((remoteState) => {
                if (areStatesEqual(localState, remoteState)) {
                    return;
                }
                console.log('Updating local state with remote one', remoteState);
                this.delegate.saveState(remoteState);
                this.notifyStateChange(localState, remoteState);
            })
            .catch((error: any) => {
                console.error('Unable to load remote state', error);
                if (error instanceof MappingError) {
                    console.info('Overwriting remote state with local one', localState);
                    this.saveRemoteState(localState).then(() => this.notifyStateChange(localState, localState));
                }
            });
        return localState;
    }

    private async saveRemoteState(state: CircuitBreakerState): Promise<void> {
        try {
            await this.client.mSet([
                this.statusKey,
                state.status,
                this.failureCountKey,
                state.consecutiveFailures.toString(),
                this.lastDetectedFailureKey,
                state.lastDetectedFailure?.getTime().toString() || '',
            ]);
        } catch (error: any) {
            console.error('Unable to update remote state');
        }
    }

    private async saveRemoteConfiguration(configuration: CircuitBreakerConfiguration): Promise<void> {
        try {
            await this.client.mSet([
                this.failureThresholdKey,
                configuration.failureThreshold.toString(),
                this.recoveryTimeoutKey,
                configuration.recoveryTimeout.toString(),
            ]);
        } catch (error: any) {
            console.error('Unable to update remote configuration');
        }
    }

    public loadConfiguration(): CircuitBreakerConfiguration {
        const configuration = this.delegate.loadConfiguration();
        this.loadRemoteConfiguration()
            .then((remoteConfiguration) => {
                if (areConfigurationsEqual(configuration, remoteConfiguration)) {
                    return;
                }
                console.log('Updating local configuration with remote one', remoteConfiguration);
                this.delegate.saveConfiguration(remoteConfiguration);
                this.notifyConfigurationChange(configuration, remoteConfiguration);
            })
            .catch((error: any) => {
                console.error('Unable to load remote configuration', error);
                if (error instanceof MappingError) {
                    console.info('Overwriting remote configuration with local one', configuration);
                    this.saveRemoteConfiguration(configuration).then(() =>
                        this.notifyConfigurationChange(configuration, configuration),
                    );
                }
            });
        return configuration;
    }

    public saveConfiguration(configuration: CircuitBreakerConfiguration): void {
        this.delegate.saveConfiguration(configuration);
        this.saveRemoteConfiguration(configuration);
    }

    private async loadRemoteConfiguration(): Promise<CircuitBreakerConfiguration> {
        const remoteValues = await this.client.mGet([this.failureThresholdKey, this.recoveryTimeoutKey]);

        console.debug('Raw configuration values loaded from Redis', remoteValues);

        const redisConfiguration = {
            failureThreshold: mapToNumber(remoteValues[0]),
            recoveryTimeout: mapToNumber(remoteValues[1]),
        };
        return redisConfiguration;
    }

    private async loadRemoteState(): Promise<CircuitBreakerState> {
        const remoteValues = await this.client.mGet([
            this.statusKey,
            this.failureCountKey,
            this.lastDetectedFailureKey,
        ]);

        console.debug('Raw state values loaded from Redis', remoteValues);

        return {
            status: mapToStatus(remoteValues[0]),
            consecutiveFailures: mapToNumber(remoteValues[1]),
            lastDetectedFailure: mapToOptionalDate(remoteValues[2]),
        };
    }
}

export { RedisCircuitBreakerStorageStrategy };
