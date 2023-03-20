import { CircuitBreakerConfiguration, CircuitBreakerState } from 'ts-breakers';

const areConfigurationsEqual = (first: CircuitBreakerConfiguration, second: CircuitBreakerConfiguration): boolean => {
    if (first === second) {
        return true;
    }
    if (first.failureThreshold === second.failureThreshold) {
        return first.recoveryTimeout === second.recoveryTimeout;
    }
    return false;
};

const areStatesEqual = (first: CircuitBreakerState, second: CircuitBreakerState): boolean => {
    if (first === second) {
        return true;
    }
    if (first.status !== second.status) {
        return false;
    }
    if (first.consecutiveFailures !== second.consecutiveFailures) {
        return false;
    }
    if (first.lastDetectedFailure?.getTime() !== second.lastDetectedFailure?.getTime()) {
        return false;
    }
    return true;
};

export { areConfigurationsEqual, areStatesEqual };
