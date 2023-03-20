import { CircuitBreakerStatus } from 'ts-breakers';

class MappingError extends Error {}

const mapToNumber = (value: string | null): number => {
    if (value === null) {
        throw new MappingError();
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        throw new MappingError();
    }
    return parsed;
};

const mapToStatus = (value: string | null): CircuitBreakerStatus => {
    switch (value) {
        case CircuitBreakerStatus.OPEN.toString():
            return CircuitBreakerStatus.OPEN;
        case CircuitBreakerStatus.CLOSED.toString():
            return CircuitBreakerStatus.CLOSED;
        case CircuitBreakerStatus.HALF_OPEN.toString():
            return CircuitBreakerStatus.HALF_OPEN;
        default:
            throw new MappingError();
    }
};

const mapToOptionalDate = (value: string | null): Date | undefined => {
    if (value === null) {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        return undefined;
    }
    return new Date(parsed);
};

export { mapToNumber, mapToStatus, mapToOptionalDate, MappingError };
